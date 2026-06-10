import { Link } from 'react-router-dom'

/** Floating primary CTA — replaces the old centre nav FAB. */
export function AddButton() {
  return (
    <Link
      to="/add"
      className="fixed bottom-24 right-5 z-20 flex items-center gap-1.5 rounded-full bg-ink px-7 py-4 text-base font-semibold text-canvas shadow-card"
    >
      <span className="text-xl leading-none">+</span> Add
    </Link>
  )
}
