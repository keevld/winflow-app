// Muestra un video corto: enlace de YouTube (se incrusta) o archivo .mp4 público.
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return m ? m[1] : null
}

export default function DemoVideo({ src }: { src: string }) {
  const yt = youtubeId(src)
  return (
    <div className="lp-video">
      {yt ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0`}
          title="Winflow en acción"
          allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <video src={src} controls playsInline preload="metadata" />
      )}
    </div>
  )
}
