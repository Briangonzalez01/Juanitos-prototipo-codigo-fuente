# Arquitectura inicial - Juanitos SaaS

## Estado actual

El prototipo operativo cubre inventario y compras: productos, ingresos, conteos, movimientos y solicitudes de compra. Está construido con React mediante Vinext, un Cloudflare Worker y Cloudflare D1 (SQLite).

La aplicación actual es de un solo negocio. Antes de habilitar clientes externos, cada dato de negocio debe quedar asociado a un `business_id` y cada solicitud debe validarse contra la membresía del usuario autenticado.

## Estructura de carpetas

```text
app/
  api/                    # Rutas HTTP; delgadas y validadas
  features/               # Funcionalidades del producto
    inventory/            # Inventario y compras
      components/          # Componentes visuales del módulo
      services/            # Casos de uso y acceso a datos del módulo
  page.tsx                # Punto de entrada de la aplicación
  layout.tsx              # Diseño raíz y metadatos
  globals.css             # Estilos globales
db/
  schema.ts               # Esquema Drizzle como fuente de verdad
drizzle/                  # Migraciones versionadas
worker/                   # Punto de entrada de Cloudflare Workers
tests/                    # Pruebas de interfaz y flujos críticos
docs/                     # Decisiones y documentación técnica
```

`app/inventory-app.tsx` se mantiene como coordinador temporal de la interfaz actual. Al añadir una pantalla o modificar una existente, se deben extraer primero los componentes de esa sección hacia `app/features/inventory/components/`, sin cambiar el comportamiento.

## Capas y responsabilidades

1. **Interfaz**: componentes React; no debe contener SQL ni secretos.
2. **API**: valida la sesión, el negocio activo y el payload; llama a servicios del dominio.
3. **Dominio**: reglas de inventario, compras, permisos y cálculos.
4. **Persistencia**: tablas Drizzle, migraciones y consultas D1.
5. **Infraestructura**: Worker, bindings Cloudflare, variables de entorno y despliegue.

## Evolución multi-negocio

Agregar estas entidades antes de vender el producto como SaaS:

- `businesses`: negocio cliente, plan y estado.
- `users`: identidad del usuario autenticado.
- `memberships`: relación usuario-negocio con rol (`owner`, `manager`, `operator`).
- `business_id`: columna obligatoria en productos, movimientos, solicitudes e ítems de compra.
- `audit_log`: actor, acción, entidad, fecha y cambios relevantes.

Regla obligatoria: todas las consultas y mutaciones filtran por `business_id`; nunca se acepta ese identificador directamente desde un formulario sin verificar la membresía en el servidor.

## Orden de implementación

1. Mantener estable el MVP actual y separar componentes por funcionalidad.
2. Incorporar autenticación y selección de negocio.
3. Crear migraciones para `businesses`, `users`, `memberships` y `business_id`.
4. Aplicar autorización por rol en cada ruta API.
5. Incorporar stock mínimo, alertas y reportes.
6. Añadir facturación, límites por plan, observabilidad y copias de seguridad antes de producción.

## Criterios de calidad

- Cada cambio de esquema usa una migración de Drizzle; no se modifica producción manualmente.
- Las rutas API validan entradas y devuelven errores comprensibles.
- Las credenciales viven solo en variables de entorno ignoradas por Git.
- Los flujos de conteo, ingreso, compra y permisos cuentan con pruebas.
- `npm run lint`, `npm test` y `npm run build` deben pasar antes de desplegar.
