# Secuencia de correos — bienvenida y sesiones

> La plataforma ya manda la bienvenida al dar de alta (`lib/correo/plantillas.ts` →
> `plantillaBienvenida`). Esta secuencia agrega lo que pidió Roberto Ortiz en la junta: el
> grupo de WhatsApp, el video de onboarding, el recordatorio del día anterior y la liga de
> sesión. Se implementan **en el mismo archivo**, con `envoltura()` y `boton()` que ya existen,
> para que salgan con la misma marca.
>
> Remitente: `CORREO_REMITENTE_NOMBRE` (VADAI Academia). Todo por Resend, nunca por SMTP.
> **Jamás** a `qa-*@academia.vadai.com.mx`.
>
> Voz: la de `../voz-y-marca.md`. Corto. Un botón por correo. Sin "estimado".

## C1 · Bienvenida (ya existe — se ajusta el texto)

**Cuándo:** al dar de alta, automático.
**Asunto:** Ya tienes acceso a Claude en tu Empresa

> Hola, [nombre].
>
> Ya tienes tu lugar en **Claude en tu Empresa**. Empezamos el **lunes 21 de septiembre a las
> [hora]**, y a partir de hoy ya puedes entrar a la plataforma.
>
> [Botón: Entrar a la academia]
>
> Entras con este correo. Si es tu primera vez, te va a pedir crear tu contraseña.
>
> Dos cosas antes del lunes, ninguna toma más de diez minutos:
> 1. **Abre tu cuenta de Claude.** Es el único prerrequisito. Aquí te llevamos de la mano:
>    [liga al video 03].
> 2. **Únete al grupo de WhatsApp del curso.** Ahí mandamos la liga de cada sesión y ahí se
>    resuelven las dudas rápidas: [liga].
>
> Y si quieres ver cómo se usa la plataforma antes de entrar, este video dura seis minutos:
> [liga al video 01].
>
> Nos vemos el lunes.
> Alejandro y Roberto

## C2 · Recordatorio del día anterior

**Cuándo:** el domingo y el miércoles, 6 PM, antes de cada sesión. Automático desde
`cohort_sessions.scheduled_at`.
**Asunto:** Mañana: sesión [N] · [tema]

> Hola, [nombre].
>
> Mañana **[día] a las [hora]** es la sesión [N]: **[tema]**.
>
> [Botón: Entrar a la sesión]
>
> Trae: [lo que pide el workbook para esa sesión — una línea].
>
> Si es tu primera sesión, este video de tres minutos te dice cómo entrar y qué hacer si algo
> falla: [liga al video 02].
>
> La liga también va a estar en el grupo de WhatsApp diez minutos antes.

## C3 · La sesión ya está grabada

**Cuándo:** al día siguiente de cada sesión, cuando se libera el módulo.
**Asunto:** Ya está abierto: [módulo o lección] + la grabación de ayer

> Hola, [nombre].
>
> Ya puedes ver la grabación de la sesión [N] y ya se abrieron las lecciones de **[módulo]** en
> la plataforma, con el workbook y las plantillas.
>
> [Botón: Ver la lección]
>
> Lo que conviene hacer antes de la siguiente sesión: [una línea del workbook].
>
> Si algo no te salió, escríbelo en la comunidad o en el WhatsApp. Para eso están.

## C4 · Cierre del curso

**Cuándo:** el día después de la sesión 8.
**Asunto:** Tu certificado, y lo que sigue

> Hola, [nombre].
>
> Terminaste. Tu certificado ya está en tu perfil:
>
> [Botón: Descargar mi certificado]
>
> El acceso a la plataforma es tuyo de por vida: las grabaciones, los prompts, las plantillas.
>
> Y lo que sigue: tienes una asesoría 1 a 1 incluida para aterrizar esto en tu empresa. Agenda
> aquí cuando quieras: [liga].
>
> Gracias por estas cuatro semanas.
> Alejandro y Roberto

## Notas de implementación

- C1 ya existe como `plantillaBienvenida(url, curso, nombre)`. Se agregan tres parámetros
  opcionales: `ligaWhatsApp`, `ligaVideoCuenta`, `ligaVideoPlataforma`.
- C2 y C3 se disparan desde un script (`scripts/correos-cohorte.mjs`, pendiente) que lee
  `cohort_sessions` y `enrollments` de la cohorte. C4 desde la emisión del certificado.
- Un fallo de correo **nunca** aborta nada: se registra y se reintenta.
- Las ligas de video son a las lecciones de los cursos gratuitos de onboarding en la propia
  plataforma, no a YouTube.
