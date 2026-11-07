/**
 * Serialises structured data for an inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` leaves `<` alone, so a title containing `</script>` would
 * close the block early. `\u003c` reads back as `<` for JSON parsers.
 */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
