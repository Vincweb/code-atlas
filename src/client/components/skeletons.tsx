import type { Tab } from '../../shared/routes'
import { cx } from '../cx'

const Bone = ({ className = '' }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cx(
      'atlas-skeleton block',
      !className.includes('rounded') && 'rounded-md',
      className,
    )}
  />
)

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cx('rounded-xl border border-line bg-panel p-4', className)}>{children}</div>
)

const WIDTHS = ['w-3/4', 'w-2/3', 'w-5/6', 'w-1/2', 'w-4/5', 'w-3/5']

const Lines = ({ count, offset = 0 }: { count: number; offset?: number }) => (
  <span className="flex flex-col gap-2">
    {Array.from({ length: count }, (_, index) => (
      <Bone key={index} className={cx('h-3', WIDTHS[(index + offset) % WIDTHS.length])} />
    ))}
  </span>
)

const OverviewSkeleton = () => (
  <div className="flex flex-col gap-8">
    <Card className="flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center sm:gap-6">
      <Bone className="size-32 shrink-0 rounded-full" />
      <span className="flex flex-1 flex-col gap-3">
        <Bone className="h-5 w-40 rounded-full" />
        <Bone className="h-6 w-3/5" />
        <Lines count={2} />
        <Bone className="h-3 w-48" />
      </span>
    </Card>

    <section className="flex flex-col gap-3">
      <Bone className="h-4 w-32" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {[0, 1, 2, 3].map((card) => (
          <Card key={card} className="flex flex-col gap-4">
            <span className="flex items-start gap-3">
              <span className="flex flex-1 flex-col gap-2">
                <Bone className="h-4 w-28" />
                <Lines count={2} offset={card} />
              </span>
              <Bone className="size-12 rounded-xl" />
            </span>
            {[0, 1, 2, 3].map((row) => (
              <span key={row} className="grid grid-cols-[1fr_5rem_2rem] items-center gap-2">
                <Bone className={cx('h-3', WIDTHS[(row + card) % WIDTHS.length])} />
                <Bone className="h-1.5 rounded-full" />
                <Bone className="h-3" />
              </span>
            ))}
          </Card>
        ))}
      </div>
    </section>

    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="flex flex-col gap-3">
        <Bone className="h-4 w-36" />
        {[0, 1, 2].map((item) => (
          <Card key={item} className="flex flex-col gap-4">
            <span className="flex items-center gap-2">
              <Bone className="h-5 w-14" />
              <Bone className="h-4 w-1/3" />
              <Bone className="ml-auto h-5 w-32 rounded-full" />
            </span>
            <span className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((column) => (
                <Lines key={column} count={3} offset={column + item} />
              ))}
            </span>
          </Card>
        ))}
      </section>
      <section className="flex flex-col gap-3">
        <Bone className="h-4 w-32" />
        <Card className="flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((step) => (
            <span key={step} className="flex gap-3">
              <Bone className="size-6 shrink-0 rounded-full" />
              <span className="flex flex-1 flex-col gap-2">
                <Bone className="h-3.5 w-2/5" />
                <Bone className={cx('h-3', WIDTHS[step % WIDTHS.length])} />
              </span>
            </span>
          ))}
        </Card>
      </section>
    </div>

    <section className="flex flex-col gap-3">
      <Bone className="h-4 w-40" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {[0, 1, 2, 3, 4, 5, 6].map((tile) => (
          <Card key={tile} className="flex flex-col gap-2 py-3">
            <Bone className="h-6 w-16" />
            <Bone className="h-3 w-4/5" />
          </Card>
        ))}
      </div>
    </section>
  </div>
)

const COLUMNS = [4, 9, 2, 5, 7, 6]

const GraphSkeleton = () => (
  <div className="flex flex-col gap-3">
    <span className="flex gap-3">
      <Bone className="h-7 w-48" />
      <Bone className="h-7 w-40" />
    </span>
    <div className="flex flex-col gap-3 lg:flex-row">
      <Card className="flex min-h-[480px] flex-1 justify-around gap-4 p-6">
        {COLUMNS.map((nodes, column) => (
          <span key={column} className="flex flex-col justify-center gap-5">
            <Bone className="mx-auto mb-2 h-3 w-14" />
            {Array.from({ length: nodes }, (_, node) => (
              <Bone key={node} className="h-7 w-24 rounded-lg" />
            ))}
          </span>
        ))}
      </Card>
      <Card className="flex flex-col gap-4 lg:w-96">
        <Lines count={2} />
        <Bone className="h-24" />
        <Lines count={4} offset={2} />
      </Card>
    </div>
  </div>
)

const RulesSkeleton = () => (
  <div className="flex flex-col gap-5">
    <span className="flex gap-2">
      <Bone className="h-7 w-44" />
      <Bone className="h-7 w-44" />
    </span>
    {[4, 4, 3].map((rows, section) => (
      <section key={section} className="flex flex-col gap-2">
        <Bone className="h-3.5 w-28" />
        <div className="rounded-lg border border-line bg-panel">
          {Array.from({ length: rows }, (_, row) => (
            <span
              key={row}
              className="flex items-center gap-2 border-b border-line px-3 py-3 last:border-b-0"
            >
              <Bone className="h-4 w-10" />
              <Bone className="h-4 w-14" />
              <Bone className={cx('h-3.5', WIDTHS[(row + section) % WIDTHS.length], 'max-w-sm')} />
              <Bone className="ml-auto h-3.5 w-20" />
            </span>
          ))}
        </div>
      </section>
    ))}
  </div>
)

const MetricsSkeleton = () => (
  <Card className="flex flex-col gap-3">
    <Bone className="h-3.5 w-24" />
    {Array.from({ length: 12 }, (_, row) => (
      <span key={row} className="grid grid-cols-[2fr_1fr_repeat(5,4rem)] gap-4">
        <Bone className={cx('h-3', WIDTHS[row % WIDTHS.length])} />
        {[0, 1, 2, 3, 4, 5].map((cell) => (
          <Bone key={cell} className="h-3" />
        ))}
      </span>
    ))}
  </Card>
)

const ConfigSkeleton = () => (
  <div className="flex flex-col gap-3">
    <Bone className="h-3.5 w-64" />
    <Card className="flex flex-col gap-2">
      {Array.from({ length: 14 }, (_, row) => (
        <Bone
          key={row}
          className={cx('h-3', WIDTHS[row % WIDTHS.length], row % 3 === 0 ? 'ml-0' : 'ml-6')}
        />
      ))}
    </Card>
  </div>
)

export const TabSkeleton = ({ tab }: { tab: Tab }) => {
  switch (tab) {
    case 'overview':
      return <OverviewSkeleton />
    case 'graph':
      return <GraphSkeleton />
    case 'rules':
    case 'audits':
      return <RulesSkeleton />
    case 'metrics':
      return <MetricsSkeleton />
    case 'config':
      return <ConfigSkeleton />
  }
}

export const HeaderSkeleton = () => (
  <span className="flex flex-col gap-1.5">
    <Bone className="h-4 w-40" />
    <Bone className="h-3 w-80 max-w-full" />
  </span>
)

export const ProgressBar = () => (
  <span aria-hidden="true" className="block h-0.5 overflow-hidden">
    <span className="atlas-progress block h-full w-1/3 rounded-full bg-accent" />
  </span>
)
