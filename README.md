# 🔐 Auditoría automática de repositorios con `npm audit fix`

Automatiza la auditoría de vulnerabilidades en múltiples proyectos de Node.js, ejecuta `npm audit fix`, genera un resumen antes y después del fix, y si hay cambios, hace `git commit` y `push` automáticamente 🚀

---

## ✨ Características

- 🧪 **Auditoría automática** con `npm audit`
- 🔧 **Corrección automática** con `npm audit fix`
- 📊 **Resumen de vulnerabilidades antes y después**
- 📤 **Commit & push automático** si se actualizan dependencias
- 🧹 **Limpieza automática** tras cada ejecución
- 📝 **Log global** con los resultados de todas las auditorías

---

## 📦 Requisitos

- Node.js `>= 18`
- Acceso a los repositorios con permisos de `push`
- Autenticación Git configurada (SSH o token guardado)

---

## 🚀 Cómo usar

### 1. Instala dependencias

```bash
npm install
