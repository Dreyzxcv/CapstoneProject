import { Button } from '@/Components/ui/button';
import { Link } from '@inertiajs/react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { FormEventHandler, ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface WizardStep {
    id: string | number;
    label: string;
    /** Only shown by the "detailed" variant. */
    description?: string;
}

/**
 * detailed: stacked circle + label + description, "Step X of Y" header on mobile,
 *           Cancel sits next to the primary button on the right. (Incident intake)
 * compact:  inline circle + label, completed steps are clickable via `onJump`,
 *           Cancel sits next to Back on the left. (Disposals)
 */
export type WizardVariant = 'detailed' | 'compact';

interface IndicatorProps {
    steps: WizardStep[];
    /** 0-based index of the active step. */
    currentIndex: number;
    variant?: WizardVariant;
    /** Called with the step index when a completed step is clicked (compact variant). */
    onJump?: (index: number) => void;
}

interface NavProps {
    isFirst: boolean;
    isLast: boolean;
    variant?: WizardVariant;
    onBack?: () => void;
    onNext?: () => void;
    backLabel?: string;
    nextLabel?: string;
    /** Label of the primary button on the last step. */
    finishLabel?: string;
    /** Label of the primary button on the last step while `processing`. Defaults to `finishLabel`. */
    processingLabel?: string;
    nextDisabled?: boolean;
    processing?: boolean;
    /** Extra class for the primary button (ignored while it is disabled). */
    nextClassName?: string;
    /** When true the last-step button is `type="submit"` and relies on the wrapping <form>. */
    submitOnLast?: boolean;
    cancelHref?: string;
    cancelLabel?: string;
}

export interface MultiStepWizardProps
    extends Omit<IndicatorProps, 'currentIndex'>,
        Omit<NavProps, 'isFirst' | 'isLast'> {
    currentIndex: number;
    isLast?: boolean;
    onSubmit?: FormEventHandler<HTMLFormElement>;
    contentClassName?: string;
    children: ReactNode;
}


export function WizardStepIndicator({ steps, currentIndex, variant = 'detailed', onJump }: IndicatorProps) {
    const total = steps.length;
    const current = steps[currentIndex];

    if (variant === 'compact') {
        const pct = ((currentIndex + 1) / total) * 100;

        return (
            <nav aria-label="Progress" className="mb-6">
                {/* Mobile: compact progress bar */}
                <div className="sm:hidden">
                    <div className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold text-gray-900">{current.label}</span>
                        <span className="text-xs text-gray-500">
                            Step {currentIndex + 1} of {total}
                        </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                </div>

                {/* Desktop: full stepper */}
                <ol className="hidden items-center sm:flex">
                    {steps.map((s, i) => {
                        const done = i < currentIndex;
                        const active = i === currentIndex;
                        return (
                            <li key={s.id} className={`flex items-center ${i < total - 1 ? 'flex-1' : ''}`}>
                                <button
                                    type="button"
                                    disabled={!done || !onJump}
                                    onClick={() => onJump?.(i)}
                                    aria-current={active ? 'step' : undefined}
                                    className="flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-default"
                                >
                                    <span
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                                            done
                                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                                : active
                                                  ? 'border-emerald-600 bg-white text-emerald-700'
                                                  : 'border-gray-300 bg-white text-gray-400'
                                        }`}
                                    >
                                        {done ? <Check className="h-4 w-4" /> : i + 1}
                                    </span>
                                    <span
                                        className={`text-sm font-medium ${
                                            active ? 'text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'
                                        }`}
                                    >
                                        {s.label}
                                    </span>
                                </button>
                                {i < total - 1 && (
                                    <span className={`mx-3 h-0.5 flex-1 ${done ? 'bg-emerald-600' : 'bg-gray-200'}`} />
                                )}
                            </li>
                        );
                    })}
                </ol>
            </nav>
        );
    }

    // detailed
    return (
        <div className="w-full">
            {/* Mobile: compact pill */}
            <div className="mb-6 flex items-center justify-between px-1 sm:hidden">
                <span className="text-sm font-semibold text-emerald-700">
                    Step {currentIndex + 1} of {total}
                </span>
                <span className="text-sm text-gray-500">{current.label}</span>
            </div>

            {/* Desktop: full stepper */}
            <nav className="mb-8 hidden items-center sm:flex" aria-label="Form steps">
                {steps.map((step, idx) => {
                    const done = currentIndex > idx;
                    const active = currentIndex === idx;
                    const upcoming = currentIndex < idx;

                    return (
                        <div key={step.id} className="flex flex-1 items-center last:flex-none">
                            <div className="flex min-w-0 flex-col items-center gap-1">
                                <div
                                    className={[
                                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                                        done ? 'border-emerald-600 bg-emerald-600 text-white' : '',
                                        active ? 'border-emerald-600 bg-white text-emerald-700' : '',
                                        upcoming ? 'border-gray-300 bg-white text-gray-400' : '',
                                    ].join(' ')}
                                >
                                    {done ? <Check className="h-4 w-4" /> : idx + 1}
                                </div>
                                <div className="text-center leading-tight">
                                    <p
                                        className={`truncate text-xs font-semibold ${
                                            active ? 'text-emerald-700' : done ? 'text-gray-700' : 'text-gray-400'
                                        }`}
                                    >
                                        {step.label}
                                    </p>
                                    {step.description && (
                                        <p className={`truncate text-[11px] ${active ? 'text-gray-500' : 'text-gray-300'}`}>
                                            {step.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {idx < total - 1 && (
                                <div
                                    className={`mx-2 mb-5 h-0.5 flex-1 rounded-full transition-colors ${
                                        done ? 'bg-emerald-500' : 'bg-gray-200'
                                    }`}
                                />
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* Progress bar (mobile) */}
            <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 sm:hidden">
                <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${total > 1 ? (currentIndex / (total - 1)) * 100 : 100}%` }}
                />
            </div>
        </div>
    );
}

export function WizardNav({
    isFirst,
    isLast,
    variant = 'detailed',
    onBack,
    onNext,
    backLabel = 'Back',
    nextLabel = 'Next',
    finishLabel = 'Confirm',
    processingLabel,
    nextDisabled = false,
    processing = false,
    nextClassName,
    submitOnLast = false,
    cancelHref,
    cancelLabel = 'Cancel',
}: NavProps) {
    const compact = variant === 'compact';

    const back = !isFirst && (
        <Button key="back" type="button" variant="outline" onClick={onBack}>
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            {backLabel}
        </Button>
    );

    const cancel = cancelHref ? (
        <Link href={cancelHref}>
            <Button type="button" variant={compact ? 'outline' : 'ghost'} className={compact ? undefined : 'text-gray-500'}>
                {cancelLabel}
            </Button>
        </Link>
    ) : null;

    // Highlight class is only applied while the button is actually enabled.
    const lastDisabled = processing || nextDisabled;

    // Distinct keys stop React from reusing one <button> element when its
    // type flips between "button" and "submit" (which could fire a stray submit).
    const primary = isLast ? (
        submitOnLast ? (
            <Button key="submit" type="submit" disabled={lastDisabled} className={lastDisabled ? undefined : nextClassName}>
                {processing ? (processingLabel ?? finishLabel) : finishLabel}
            </Button>
        ) : (
            <Button
                key="finish"
                type="button"
                onClick={onNext}
                disabled={lastDisabled}
                className={lastDisabled ? undefined : nextClassName}
            >
                {processing ? (processingLabel ?? finishLabel) : finishLabel}
            </Button>
        )
    ) : (
        <Button
            key="next"
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={nextDisabled ? undefined : nextClassName}
        >
            {nextLabel}
            <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
    );

    if (compact) {
        return (
            <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                    {back}
                    {cancel}
                </div>
                {primary}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between pb-8 pt-2">
            <div>{back}</div>
            <div className="flex gap-3">
                {cancel}
                {primary}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

export default function MultiStepWizard({
    steps,
    currentIndex,
    variant = 'detailed',
    isLast,
    onJump,
    onSubmit,
    contentClassName = 'space-y-6',
    children,
    ...nav
}: MultiStepWizardProps) {
    const body = (
        <>
            {children}
            <WizardNav
                variant={variant}
                isFirst={currentIndex === 0}
                isLast={isLast ?? currentIndex === steps.length - 1}
                {...nav}
            />
        </>
    );

    return (
        <>
            <WizardStepIndicator steps={steps} currentIndex={currentIndex} variant={variant} onJump={onJump} />
            {onSubmit ? (
                <form onSubmit={onSubmit} noValidate className={contentClassName}>
                    {body}
                </form>
            ) : (
                <div className={contentClassName}>{body}</div>
            )}
        </>
    );
}