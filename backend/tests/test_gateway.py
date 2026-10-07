"""Automated unit test suite for application gateway entrypoint, health, and CORS."""

from fastapi.testclient import TestClient


def test_health_check_endpoint(client: TestClient) -> None:
    """Test 1: GET /health returns HTTP 200 with healthy service payload."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "scotopic-backend",
        "version": "1.0.0",
    }


def test_cors_middleware_headers(client: TestClient) -> None:
    """Test 2: CORS middleware responds with Access-Control-Allow-Origin: * and allowed headers on OPTIONS preflight."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization,Content-Type",
    }
    response = client.options("/health", headers=headers)
    assert response.status_code == 200
    # With allow_credentials=True, W3C spec requires reflecting the request origin
    assert response.headers.get("access-control-allow-origin") in ("*", "http://localhost:5173")
    assert "GET" in response.headers.get("access-control-allow-methods", "")


def test_unknown_route_returns_404(client: TestClient) -> None:
    """Test 3: Unknown route returns HTTP 404 with standard JSON error envelope."""
    response = client.get("/api/v1/nonexistent_route")
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert data["detail"] == "Not Found"
