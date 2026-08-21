# Checklist QA

> **Sin firmar.** 1 paso(s) fallaron. Ver el detalle abajo.

| | |
|---|---|
| Fecha | 21 de agosto de 2026 a las 2:09 p.m. (CDMX) |
| Commit | `7ee8304` en `main` |
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
| ✅ | Las diez suites de milestone | 10 suites, 282 aserciones |

## Higiene

| | Paso | Resultado |
|---|---|---|
| ✅ | Storage reconciliado (sin huérfanos ni colgantes) | sin huérfanos |

## Producción

| | Paso | Resultado |
|---|---|---|
| ❌ | Smoke test del dominio en vivo | 3 de 24 comprobaciones fallaron |

---

## Lo que falló

### Smoke test del dominio en vivo

```
  ✓  /auth/callback está permitido (login con Google)         ok
  ✓  /auth/confirmar permitido (opcional, red de respaldo)    ok
  ✓  /nueva-contrasena permitido (opcional, red de respaldo)  ok
  ✓  /mis-cursos permitido (opcional, red de respaldo)        ok

  LO QUE VERCEL TIENE DE VERDAD
  ─────────────────────────────────────────────────────────────────────────────────
  ✗  coincide con el dominio esperado                         http://academia.vadai.com.mx/auth/callback
  ✗  usa https                                                http://academia.vadai.com.mx/auth/callback
  ✗  y ese valor SÍ está en la lista blanca                   rebota a https://academia.vadai.com.mx

  ─────────────────────────────────────────────────────────────────────────────────
  3 de 24 comprobaciones FALLARON:
    LO QUE VERCEL TIENE DE VERDAD · coincide con el dominio esperado  http://academia.vadai.com.mx/auth/callback
    LO QUE VERCEL TIENE DE VERDAD · usa https  http://academia.vadai.com.mx/auth/callback
    LO QUE VERCEL TIENE DE VERDAD · y ese valor SÍ está en la lista blanca  rebota a https://academia.vadai.com.mx

  ── Cómo arreglar NEXT_PUBLIC_APP_URL ──────────────────────
  Vercel → Settings → Environment Variables:

    NEXT_PUBLIC_APP_URL = https://academia.vadai.com.mx

  Con https y sin barra final. Después hay que REDEPLOYAR:
  las NEXT_PUBLIC_* se hornean en el build, así que cambiar
  la variable sin volver a construir no cambia nada.
```

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
