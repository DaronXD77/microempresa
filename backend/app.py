"""
Punto de entrada - Tienda Virtual UMSA Somos Todos
"""
import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "1").lower() in ("1", "true", "yes")
    
    print("=" * 50)
    print("TIENDA VIRTUAL UMSA SOMOS TODOS")
    print("=" * 50)
    print(f"Servidor en: http://localhost:{port}")
    print(f"Superadmin base: daron.augusto@gmail.com")
    print(f"Password: umsasomostodosadmin*$312")
    print("=" * 50)
    
    app.run(host="0.0.0.0", port=port, debug=debug)
