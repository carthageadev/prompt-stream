# Deployment Checklist

This guide outlines the steps to deploy the **Stream Prompts** application to a Virtual Private Server (VPS) using Docker Compose.

## Prerequisites

- [ ] **VPS**: A server running Linux (Ubuntu 22.04 LTS recommended) with at least 2GB RAM.
- [ ] **Domain**: A domain name pointing to your VPS IP address (e.g., `prompts.example.com`).
- [ ] **Docker**: Docker Engine and Docker Compose installed on the VPS.
  - [Install Docker on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)

## Deployment Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-repo/stream-prompts.git
    cd stream-prompts
    ```

2.  **Environment Configuration**
    - Create a `.env` file (if referencing one in docker-compose, though currently values are inline or defaults).
    - **Production Database Password**: Change the `POSTGRES_PASSWORD` in `docker-compose.yml` to a strong secret.
    - **Update Connection String**: Update the `DATABASE_URL` in `docker-compose.yml` to match the new password.

3.  **Start Services**
    ```bash
    docker compose up -d --build
    ```

4.  **Verify Status**
    ```bash
    docker compose ps
    docker compose logs -f backend
    ```
    Ensure the backend runs migrations/seeding successfully (`Application startup complete`).

5.  **Reverse Proxy (Example with Nginx on Host)**
    If you want HTTPS (highly recommended), set up Nginx on the host machine using Certbot.

    ```nginx
    server {
        server_name prompts.example.com;
        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
    ```

## Security Checklist

- [ ] **Rate Limiting**: Backend is configured with `slowapi` (Default: 100/minute).
- [ ] **CORS**: Ensure `CORS_ORIGINS` in `docker-compose.yml` is set to your specific domain details in production, not just localhost.
- [ ] **Firewall**: Ensure only ports 80/443 (and 22 for SSH) are open. Block port 5432 (Postgres) from external access; Docker internal network handles the connection.
