"""Authentication routes"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, get_current_admin
from app.database import get_db
from app.limiter import limiter
from app.matrix_client import MatrixAdminClient
from app.matrix_token import encrypt_matrix_token
from app.models import User
from app.schemas import LoginRequest, LoginResponse, UserResponse
from app.security_errors import public_error_detail
from app.settings import ACCESS_TOKEN_EXPIRE_MINUTES, cookie_secure
import os
from typing import List

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        samesite="lax",
        secure=cookie_secure(),
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.set_cookie(
        key="access_token",
        value="",
        max_age=0,
        httponly=True,
        samesite="lax",
        secure=cookie_secure(),
        path="/",
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    login_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Login with Matrix credentials"""
    try:
        matrix_server_url = os.getenv("MATRIX_SERVER_URL")
        if not matrix_server_url:
            raise HTTPException(
                status_code=500,
                detail="MATRIX_SERVER_URL not configured in environment",
            )

        matrix_client = MatrixAdminClient(matrix_server_url, "")
        login_response = await matrix_client.login(login_data.username, login_data.password)
        matrix_access_token = login_response.get("access_token")
        matrix_user_id = login_response.get("user_id")

        if not matrix_access_token:
            raise HTTPException(status_code=401, detail="Failed to get Matrix access token")

        admin_client = MatrixAdminClient(matrix_server_url, matrix_access_token)
        try:
            await admin_client.get_users(limit=1)
        except HTTPException as e:
            if e.status_code in [401, 403]:
                raise HTTPException(status_code=403, detail="User is not a Matrix server admin")
            raise

        encrypted_token = encrypt_matrix_token(matrix_access_token)

        db_user = db.query(User).filter(User.username == login_data.username).first()
        if db_user:
            db_user.matrix_access_token = encrypted_token
            db_user.matrix_user_id = matrix_user_id
            db_user.matrix_server_url = matrix_server_url
            db_user.last_login = datetime.utcnow()
        else:
            db_user = User(
                username=login_data.username,
                matrix_user_id=matrix_user_id,
                matrix_access_token=encrypted_token,
                matrix_server_url=matrix_server_url,
                last_login=datetime.utcnow(),
            )
            db.add(db_user)

        db.commit()
        db.refresh(db_user)

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": db_user.username}, expires_delta=access_token_expires
        )

        await matrix_client.close()
        await admin_client.close()

        _set_session_cookie(response, access_token)

        return LoginResponse()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Login failed", e),
        )


@router.post("/logout")
async def logout(response: Response):
    """Clear session cookie (HttpOnly)."""
    _clear_session_cookie(response)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user


@router.get("/admins", response_model=List[UserResponse])
async def get_admins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Get list of all admins in the database"""
    admins = db.query(User).filter(User.is_active == True).all()
    return admins
