# back-end/app/auth/dependencies.py
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.auth.jwt_handler import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_role(required_role: str):
    def role_checker(user=Depends(get_current_user)):
        if user.get("role") != required_role:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return role_checker


def get_any_authenticated_user(current_user: dict = Depends(get_current_user)):
    """
    Issue #1: Everyone is a PI.
    Any authenticated user (admin, reviewer, user) can act as PI.
    Just verifies the token is valid and sub is present.
    """
    if not current_user.get("sub"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user