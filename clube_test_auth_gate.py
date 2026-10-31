"""Run locally: pip install httpx pytest; pytest -q clube_test_auth_gate.py"""
import os
from fastapi.testclient import TestClient
from clube_api import app
client=TestClient(app)

def test_health_does_not_claim_business_ready():
    r=client.get("/health")
    assert r.status_code==200
    assert r.json()["status"]=="alive"

def test_ready_denied_without_database(monkeypatch):
    monkeypatch.setattr("clube_api.DB_URL","")
    r=client.get("/ready")
    assert r.status_code==503

def test_untrusted_user_cannot_read_admin_data():
    for path in ("/me","/admin/summary","/admin/users","/admin/audit"):
        r=client.get(path)
        assert r.status_code==401

def test_untrusted_user_cannot_issue_invites():
    r=client.post("/admin/invites",json={"email":"teste@example.com","role":"admin"})
    assert r.status_code in (401,422)

def test_no_caching_of_sensitive_responses():
    r=client.get("/me")
    assert "no-store" in r.headers.get("cache-control","")
