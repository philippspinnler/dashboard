// Ports dashboard-api/app/plugins/presence.py — who's home, from Home Assistant
// person entities. Cache TTL mirrors @cache(expire=120).
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('presence')

    const config = useRuntimeConfig(event)
    const baseUrl = config.homeAssistantUrl
    const entities = parseList(config.homeAssistantPersonEntities)

    const persons = []
    for (const entityId of entities) {
      const ent: any = await haEntity(event, entityId)
      if (!ent) continue
      const attrs = ent.attributes || {}
      let avatarUrl = attrs.entity_picture || null
      if (avatarUrl && avatarUrl.startsWith('/')) avatarUrl = `${baseUrl}${avatarUrl}`
      persons.push({
        name: attrs.friendly_name || entityId,
        avatar_url: avatarUrl,
        state: ent.state,
      })
    }

    persons.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    return { persons }
  },
  { maxAge: 120 },
)
