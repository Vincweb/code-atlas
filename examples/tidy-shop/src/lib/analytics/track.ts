export const track = (event: string, payload: any) => {
  const body: any = { event, payload, at: Date.now() }
  void navigator.sendBeacon('/collect', JSON.stringify(body))
}
