# Checklist QA

> **Firmado.** Todos los pasos críticos en verde.

| | |
|---|---|
| Fecha | 21 de septiembre de 2026 a las 10:54 a.m. (CDMX) |
| Commit | `fea575b` en `main` |
| Árbol | **con cambios sin commitear** |

Se regenera con `pnpm qa`, que corre cada paso de verdad. Un checklist que
se palomea a mano se palomea igual esté verde o roja la cosa; este firma con
el commit, así que dice qué versión exacta pasó.

---

## Código

| | Paso | Resultado |
|---|---|---|
| ✅ | TypeScript estricto, sin `any` | ok |
| ✅ | ESLint limpio | ok |
| ✅ | Build de producción | compila |

## Infraestructura

| | Paso | Resultado |
|---|---|---|
| ✅ | Infraestructura: env, schema expuesto, buckets, Auth | ok |
| ✅ | Migraciones al día | al día |
| ✅ | Credenciales de Bunny Stream | ok |

## Funcionalidad

| | Paso | Resultado |
|---|---|---|
| ✅ | Datos QA sembrados | ok |
| ✅ | Las once suites de milestone | 13 suites, 632 aserciones |

## Higiene

| | Paso | Resultado |
|---|---|---|
| ✅ | Storage reconciliado (sin huérfanos ni colgantes) | sin huérfanos |
| ✅ | Cursos QA archivados, fuera del panel del admin | ok |

## Producción

| | Paso | Resultado |
|---|---|---|
| ✅ | Smoke test del dominio en vivo | 24 comprobaciones |

---

## Lo que este checklist NO puede firmar

Queda fuera lo que ningún script puede comprobar solo, y conviene tenerlo a
la vista para no confundir "en verde" con "listo":

- **Login con Google de punta a punta.** Se comprueba que el `redirect_to`
  esté permitido, pero completar el consentimiento de Google necesita un
  humano con una cuenta real.
- **Que un correo llegue a la bandeja.** Se comprueba que Resend lo acepte,
  no que no caiga en spam.
- **Un pago real de Stripe.** La suite firma eventos sintéticos con el
  `whsec_` verdadero, que cubre más casos que un pago feliz, pero no es un
  cargo real.
- **Que un video de Bunny se reproduzca.** Se comprueba la firma del token,
  no la reproducción.
- **Cómo se ve en un teléfono de verdad.**
