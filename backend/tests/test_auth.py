from app.models import User
from app.seed import seed_admin_user


def test_login_success(client):
    response = client.post("/auth/login", json={"username": "admin", "password": "admin-password"})
    assert response.status_code == 200
    assert "session" in response.cookies


def test_login_invalid_credentials(client):
    response = client.post("/auth/login", json={"username": "admin", "password": "wrong"})
    assert response.status_code == 401


def test_protected_route_requires_auth(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_after_login(client):
    client.post("/auth/login", json={"username": "admin", "password": "admin-password"})
    response = client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_logout_clears_session(client):
    client.post("/auth/login", json={"username": "admin", "password": "admin-password"})
    logout = client.post("/auth/logout")
    assert logout.status_code == 200

    response = client.get("/auth/me")
    assert response.status_code == 401


def test_admin_seed_not_duplicated_on_restart(client, db_session):
    count_before = db_session.query(User).count()
    seed_admin_user(db_session)
    count_after = db_session.query(User).count()

    assert count_before == 1
    assert count_after == 1
