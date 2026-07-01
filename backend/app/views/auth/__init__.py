def auth_response(user_data, role, available_roles, status=200):
    return (
        {
            "user": user_data,
            "role": role,
            "available_roles": available_roles,
        },
        status,
    )


def guest_response():
    return (
        {
            "user": {"nombre": "Invitado"},
            "role": "cliente",
            "available_roles": ["cliente"],
        },
        200,
    )
