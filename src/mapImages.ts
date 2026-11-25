import ancient from './assets/maps/ancient.jpg'
import anubis from './assets/maps/anubis.jpg'
import cache from './assets/maps/cache.jpg'
import dust2 from './assets/maps/dust2.jpg'
import inferno from './assets/maps/inferno.jpg'
import mirage from './assets/maps/mirage.jpg'
import nuke from './assets/maps/nuke.jpg'

// Optional photo per map id, shown on the map tiles. Maps without one use their gradient.
const MAP_IMAGES: Record<string, string> = {
  mirage,
  inferno,
  dust2,
  nuke,
  ancient,
  anubis,
  cache,
}

/** CSS background for a map tile: the photo (darkened for legible text) or the map's gradient. */
export function mapTileBackground(mapId: string, fallback: string): string {
  const img = MAP_IMAGES[mapId]
  if (!img) return fallback
  return `linear-gradient(to top, rgba(8, 9, 11, 0.9), rgba(8, 9, 11, 0.3) 60%, rgba(8, 9, 11, 0.6)), url("${img}") center / cover no-repeat, ${fallback}`
}
