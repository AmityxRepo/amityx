import { useState } from 'react'
import { CalendarPlus, Camera, CircleCheck, CircleX, Send, TriangleAlert, Undo2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Label from '../../components/ui/Label'
import Textarea from '../../components/ui/Textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table'
import ThemeToggle from '../../components/ThemeToggle'

/**
 * Renders every base component + token in one place — the living proof that
 * app/DESIGN.md's tokens/components are wired up, not just described in prose.
 * Dev-only route; not linked from any real nav. See app/DESIGN.md.
 */
export default function KitchenSink() {
  const [nameError, setNameError] = useState(false)

  const colorSwatches: Array<{ name: string; bg: string; fg: string }> = [
    { name: 'background / foreground', bg: 'bg-background', fg: 'text-foreground' },
    { name: 'card / card-foreground', bg: 'bg-card', fg: 'text-card-foreground' },
    { name: 'muted / muted-foreground', bg: 'bg-muted', fg: 'text-muted-foreground' },
    { name: 'primary / primary-foreground', bg: 'bg-primary', fg: 'text-primary-foreground' },
    { name: 'accent / accent-foreground', bg: 'bg-accent', fg: 'text-accent-foreground' },
    { name: 'destructive / destructive-foreground', bg: 'bg-destructive', fg: 'text-destructive-foreground' },
    { name: 'success / success-foreground', bg: 'bg-success', fg: 'text-success-foreground' },
    { name: 'warning / warning-foreground', bg: 'bg-warning', fg: 'text-warning-foreground' },
  ]

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-10">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Route stub: <code>/dev/kitchen-sink</code>
            </p>
            <h1 className="text-3xl font-bold text-foreground">Kitchen sink</h1>
            <p className="mt-1 text-base text-muted-foreground">
              Every token and base component from app/DESIGN.md, rendered. Dev-only.
            </p>
          </div>
          <ThemeToggle />
        </header>

        {/* Typography */}
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Typography</h2>
          <p className="text-5xl font-bold text-foreground">Display 48</p>
          <p className="text-2xl font-semibold text-foreground">Heading 24</p>
          <p className="text-xl font-semibold text-foreground">Heading-sm 20</p>
          <p className="text-base text-foreground">Body 16 — the floor for any reading copy.</p>
          <p className="text-sm text-muted-foreground">Small 14 — captions, hints, metadata.</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Micro 12 — eyebrows only</p>
        </section>

        {/* Color tokens */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Color tokens</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {colorSwatches.map((s) => (
              <div key={s.name} className={`rounded-lg border border-border p-3 ${s.bg}`}>
                <p className={`text-sm font-medium ${s.fg}`}>{s.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Buttons — icon + verb phrase, never icon-only</h2>
          <div className="flex flex-wrap gap-3">
            <Button icon={CalendarPlus}>Add a class</Button>
            <Button variant="secondary" icon={Send}>
              Send to families
            </Button>
            <Button variant="outline" icon={Undo2}>
              Undo
            </Button>
            <Button variant="ghost">Skip for now</Button>
            <Button variant="destructive" icon={CircleX}>
              Remove child
            </Button>
            <Button size="sm" icon={Camera}>
              Post a photo
            </Button>
            <Button disabled icon={Send}>
              Sending…
            </Button>
          </div>
        </section>

        {/* Badges */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Badges — dual-encoded (icon + word, never hue alone)</h2>
          <div className="flex flex-wrap gap-2">
            <Badge>Draft</Badge>
            <Badge variant="primary">Featured</Badge>
            <Badge variant="success" icon={CircleCheck}>
              Checked in
            </Badge>
            <Badge variant="warning" icon={TriangleAlert}>
              Needs attention
            </Badge>
            <Badge variant="destructive" icon={CircleX}>
              Checked out
            </Badge>
          </div>
        </section>

        {/* Form */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Forms</h2>
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Add a child</CardTitle>
              <CardDescription>Used on the roster screen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                label="Child's name"
                htmlFor="ks-name"
                required
                error={nameError ? "This removes nothing — just tell us the child's name to continue." : undefined}
              >
                <Input
                  id="ks-name"
                  placeholder="e.g. Mia"
                  invalid={nameError}
                  onChange={(e) => setNameError(e.target.value.length === 0)}
                />
              </FormField>
              <FormField label="Notes" htmlFor="ks-notes" hint="Visible to staff only.">
                <Textarea id="ks-notes" placeholder="Allergies, naps, anything staff should know" />
              </FormField>
              <div className="flex items-center gap-2">
                <input id="ks-consent" type="checkbox" className="h-5 w-5 rounded border-input" />
                <Label htmlFor="ks-consent" className="mb-0">
                  Family gave photo consent
                </Label>
              </div>
            </CardContent>
            <CardFooter>
              <Button icon={CalendarPlus}>Save child</Button>
              <Button variant="ghost">Cancel</Button>
            </CardFooter>
          </Card>
        </section>

        {/* Table */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Table</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Mia R.</TableCell>
                <TableCell>Tuesday Art</TableCell>
                <TableCell>
                  <Badge variant="success" icon={CircleCheck}>
                    Checked in
                  </Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Leo T.</TableCell>
                <TableCell>Toddler Swim</TableCell>
                <TableCell>
                  <Badge icon={CircleX}>Checked out</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        {/* Empty state */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Empty state — teaches the next step</h2>
          <EmptyState
            icon={CalendarPlus}
            title="No classes yet"
            description="Add your first class to start taking bookings."
            action={<Button icon={CalendarPlus}>Add your first class</Button>}
          />
        </section>
      </div>
    </div>
  )
}
