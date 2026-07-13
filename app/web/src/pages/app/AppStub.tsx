/** Generic named stub for /app/* sub-routes not yet built. */
export default function AppStub({ title, lands }: { title: string; lands: string }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1">Lands in {lands}.</p>
    </div>
  )
}
