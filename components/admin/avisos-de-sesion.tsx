/**
 * Qué pasa al agendar (M17): el anuncio y el correo a los inscritos. Dos
 * casillas, y no una regla escondida, porque no toda sesión se anuncia (una
 * de prueba, una que se mueve). En V-AI-P vienen marcadas: así lo decidió
 * Alejandro para las clases de la comunidad.
 */
export function AvisosDeSesion({ marcadas = false }: { marcadas?: boolean }) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-[10px] border border-border p-3">
      <legend className="px-1 text-sm font-medium">Al agendar</legend>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="anunciar" value="si" defaultChecked={marcadas} className="mt-0.5 size-4 accent-vadai-cyan" />
        <span>Publicar un anuncio con la fecha, la hora y la liga para entrar.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="avisar" value="si" defaultChecked={marcadas} className="mt-0.5 size-4 accent-vadai-cyan" />
        <span>Mandar correo a todos los inscritos, con el evento para su calendario.</span>
      </label>
    </fieldset>
  )
}
