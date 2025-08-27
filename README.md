# ERP

Este repositorio contiene tanto el **backend (API en Laravel)** como el **frontend (Web en React/Vite)** del sistema ERP.

---

````markdown
# ERP Monorepo

Este repositorio contiene tanto el **backend (API en Laravel)** como el **frontend (Web en React/Vite)** del sistema ERP.

---

## 📂 Estructura

- **api/** → Backend en PHP/Laravel  
- **web/** → Frontend en React/Vite  

---

## 🚀 Desarrollo local

### 1. Backend (api/)
```bash
cd api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
````

* Corre normalmente en: [http://localhost:8000](http://localhost:8000)

---

### 2. Frontend (web/)

```bash
cd web
npm install
npm run dev
```

* Corre normalmente en: [http://localhost:5173](http://localhost:5173)
* Configura la variable `VITE_API_URL` en el `.env` del frontend para apuntar a la API.

---

## 🔑 Convenciones

* **Ramas principales**: usamos `main` como rama principal.
* **Tags de versión**: se aplican al monorepo completo.
* **Commits**: prefijo recomendado:

  * `feat:` nuevas funcionalidades
  * `fix:` correcciones
  * `chore:` mantenimiento, tareas de CI/CD
  * `docs:` cambios de documentación

---

## 🤝 Colaboración

1. Crea una rama desde `main` para cada feature/fix.
2. Abre un Pull Request con descripción clara.
3. Asegúrate de que las pruebas pasen antes de hacer merge.
