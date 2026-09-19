// One customer number: chat history, send box, online toggle, auto-reply gear.
interface TileProps {
  number: string
}

export default function Tile({ number }: TileProps) {
  return (
    <section data-testid={`tile-${number}`}>
      <h2>{number}</h2>
    </section>
  )
}
