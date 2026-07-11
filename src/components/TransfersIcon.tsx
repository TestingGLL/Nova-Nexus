// Ícono de "Transferencias" (estilo Material "send"). Usa currentColor para
// heredar el color del contexto (barra superior, pestañas de Software, hero).
export default function TransfersIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className={className} aria-hidden="true">
      <path d="M140-190v-580l688.46 290L140-190Zm60-90 474-200-474-200v147.69L416.92-480 200-427.69V-280Zm0 0v-400 400Z" />
    </svg>
  )
}
