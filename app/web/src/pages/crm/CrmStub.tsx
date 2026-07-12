/** Generic named stub for /crm/* sub-routes not yet built. */
export default function CrmStub({ title, lands }: { title: string; lands: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-1">Lands in {lands}.</p>
    </div>
  )
}
