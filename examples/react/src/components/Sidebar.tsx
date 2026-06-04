import { useEffect, useState } from 'react'

export interface NavItem {
  id: string
  label: string
}

/** Sidebar with IntersectionObserver-based active-section highlighting. */
export function Sidebar({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      // Trip when a heading reaches the upper third of the viewport.
      { rootMargin: '-10% 0px -75% 0px' },
    )
    for (const { id } of items) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  return (
    <aside className="sidebar">
      <nav>
        <p className="sidebar-title">Documentation</p>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={active === item.id ? 'is-active' : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
