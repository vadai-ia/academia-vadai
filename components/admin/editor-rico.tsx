'use client'

import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import type { Json } from '@/lib/supabase/types'

/**
 * Editor de texto enriquecido (Tiptap, §5).
 *
 * Persiste JSON, no HTML: así el render del alumno es controlado y no hay forma
 * de inyectar markup arbitrario en la página. El JSON viaja al servidor en un
 * input oculto, para que el formulario siga siendo un `<form>` normal y la
 * server action lo reciba por FormData como todo lo demás.
 */

const BOTONES = [
  { clave: 'bold', etiqueta: 'B', titulo: 'Negrita', clase: 'font-bold' },
  { clave: 'italic', etiqueta: 'i', titulo: 'Cursiva', clase: 'italic' },
  { clave: 'bulletList', etiqueta: '•', titulo: 'Lista' },
  { clave: 'orderedList', etiqueta: '1.', titulo: 'Lista numerada' },
] as const

function aplicar(editor: Editor, clave: (typeof BOTONES)[number]['clave']) {
  const cadena = editor.chain().focus()
  switch (clave) {
    case 'bold':
      cadena.toggleBold().run()
      break
    case 'italic':
      cadena.toggleItalic().run()
      break
    case 'bulletList':
      cadena.toggleBulletList().run()
      break
    case 'orderedList':
      cadena.toggleOrderedList().run()
      break
  }
}

export function EditorRico({
  nombre,
  contenidoInicial,
  etiqueta,
  ayuda,
}: {
  nombre: string
  contenidoInicial: Json | null
  etiqueta: string
  ayuda?: string
}) {
  const [json, setJson] = useState(() =>
    contenidoInicial ? JSON.stringify(contenidoInicial) : ''
  )

  const editor = useEditor({
    extensions: [StarterKit],
    content: (contenidoInicial as object | null) ?? '',
    // Sin esto Next avisa de un desajuste de hidratación: el editor se monta
    // solo en el cliente.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-40 w-full rounded-b-md bg-transparent px-3 py-2 text-sm outline-none ' +
          '[&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 ' +
          '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold',
      },
    },
    onUpdate({ editor: actual }) {
      setJson(actual.isEmpty ? '' : JSON.stringify(actual.getJSON()))
    },
  })

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{etiqueta}</span>

      <div className="rounded-md border border-input">
        <div className="flex items-center gap-1 border-b border-input px-2 py-1.5">
          {BOTONES.map((boton) => (
            <button
              key={boton.clave}
              type="button"
              title={boton.titulo}
              aria-label={boton.titulo}
              aria-pressed={editor?.isActive(boton.clave) ?? false}
              onClick={() => editor && aplicar(editor, boton.clave)}
              className={cn(
                'size-7 rounded text-sm hover:bg-muted',
                'clase' in boton ? boton.clase : undefined,
                editor?.isActive(boton.clave) && 'bg-muted text-primary'
              )}
            >
              {boton.etiqueta}
            </button>
          ))}
        </div>

        <EditorContent editor={editor} />
      </div>

      {ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}

      <input type="hidden" name={nombre} value={json} />
    </div>
  )
}
