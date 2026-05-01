# Matrix Federation Guide

This guide explains Matrix federation in plain terms and the easiest way to get it working for a Synapse server used with MAPS.

Or refer to the [Offical Element Docs](https://element-hq.github.io/synapse/latest/federate.html)

## What federation means

Matrix federation is how your homeserver talks to other Matrix homeservers.

When federation is working, users on your server can:

- Join rooms hosted on other servers
- Exchange messages with users from other domains
- Sync room state/events across servers

## Easiest setup path (recommended)

The fastest reliable setup is:

1. Use a real DNS name (for example `matrix.example.com`)
2. Put Synapse behind a reverse proxy (Nginx/Caddy/Traefik)
3. Expose HTTPS publicly
4. Make sure federation traffic reaches Synapse on port `8448` (directly or via proxy)

In practice, this usually means:

- `https://matrix.example.com` serves client traffic
- `https://matrix.example.com:8448` serves federation traffic

## Minimum Synapse config checklist

In your `homeserver.yaml`, verify these are set correctly:

- `server_name`: your public Matrix domain
- `public_baseurl`: `https://<your-domain>/`
- listeners include the required client/federation resources
- TLS/proxy settings match your deployment

Also confirm:

- DNS `A`/`AAAA` records point to your server
- Port `8448` is reachable from the internet
- Firewall/security groups allow inbound `8448`

## Optional: `.well-known` (if using a different host/port)

If your Matrix server name is not directly serving federation on `:8448`, add:

- `https://<server-name>/.well-known/matrix/server`

Example:

```json
{
  "m.server": "federation-host.example.com:443"
}
```

This tells other homeservers where to send federation requests.

## Quick verification

1. Open MAPS and go to the Federation page
2. Check destination status (online/retrying/failed)
3. For failed destinations, use **Reset Connection** and retry
4. Watch if `retry_interval` and `failure_ts` improve over time

## Common problems

- Wrong `server_name` or DNS mismatch
- Port `8448` blocked by firewall/NAT
- TLS cert does not match the Matrix domain
- Reverse proxy not forwarding federation endpoints
- Missing/incorrect `.well-known` when using non-standard routing

## MAPS note

MAPS reads federation state from the Synapse Admin API. If Synapse federation is healthy, MAPS Federation should show healthy destinations as well.
