import { cn } from "@rallly/ui";
import { Button } from "@rallly/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rallly/ui/dropdown-menu";
import { Input } from "@rallly/ui/input";
import { RadioCards, RadioCardsItem } from "@rallly/ui/radio-pills";
import {
  CalendarIcon,
  CalendarXIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreVerticalIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import { useFormContext } from "react-hook-form";
import DateCard from "@/components/date-card";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "@/components/empty-state";
import { useHeadlessDatePicker } from "@/components/headless-date-picker";
import type { NewEventData } from "@/features/poll/components/forms/types";
import { useUser } from "@/features/user/client";
import { Trans, useTranslation } from "@/i18n/client";
import { useDateTimeConfig } from "@/lib/datetime/client";
import { Duration } from "@/lib/datetime/duration";
import { formatDateParts } from "@/lib/datetime/format";
import {
  addMinutesToWallTime,
  wallTimeDiffInMinutes,
} from "@/lib/datetime/wall-time";
import { dayjs } from "@/lib/dayjs";
import {
  expectTimeOption,
  getBrowserTimeZone,
} from "@/lib/utils/date-time-utils";
import type { DateTimeOption, DateTimePickerProps } from "../types";
import { formatDateWithoutTime, removeAllOptionsForDay } from "../utils";
import TimePicker from "./time-picker";

// Options are floating wall-clock strings, so times are computed on the
// strings themselves and never pass through the browser's zone.
const middayOf = (date: string) => `${date}T12:00:00`;

/** Local noon of the option's calendar date, for navigating the date picker. */
const navigationDateOf = (wallTime: string) =>
  new Date(middayOf(wallTime.slice(0, 10)));

const MonthCalendar: React.FunctionComponent<DateTimePickerProps> = ({
  options,
  onNavigate,
  date,
  onChange,
  duration,
  onChangeDuration,
  timeZone,
}) => {
  const { t } = useTranslation();
  const { locale } = useDateTimeConfig();
  const { user } = useUser();
  const defaultTimeZone = user?.timeZone || getBrowserTimeZone();
  // Time-based options are the default. With no options yet the selected
  // duration drives the mode (0 = all-day) so the first selection creates the
  // right kind of option; once options exist their type is the source of truth.
  const isTimedEvent =
    options.length > 0
      ? options.some((option) => option.type === "timeSlot")
      : duration !== 0;

  const form = useFormContext<NewEventData>();
  const dragRef = React.useRef<{
    pointerId: number;
    start: string;
    end: string;
  } | null>(null);
  const ignoreClickRef = React.useRef(false);
  const [rangePreview, setRangePreview] = React.useState<{
    start: string;
    end: string;
  } | null>(null);

  // Durations currently in use across the timed options. When they all share a
  // single value the radio group selects it; differing values show as "Mixed".
  const optionDurations = options.flatMap((option) =>
    option.type === "timeSlot"
      ? [wallTimeDiffInMinutes(option.start, option.end)]
      : [],
  );
  const uniformDuration =
    optionDurations.length > 0 &&
    optionDurations.every((d) => d === optionDurations[0])
      ? optionDurations[0]
      : null;
  const isMixed = optionDurations.length > 0 && uniformDuration === null;

  const durationValue = !isTimedEvent
    ? "all-day"
    : isMixed
      ? "mixed"
      : String(uniformDuration ?? duration);

  // Standard presets, plus the current duration if it's a non-standard value
  // (e.g. set by dragging in the week view) so the selection stays visible.
  const durationPresets = [30, 60, 90, 120];
  const durationOptions =
    uniformDuration !== null && !durationPresets.includes(uniformDuration)
      ? [...durationPresets, uniformDuration].sort((a, b) => a - b)
      : durationPresets;

  // Length to use whenever we build a time slot. `duration` is 0 in all-day
  // mode; fall back to an hour so a slot is never zero-length.
  const slotDuration = duration || 60;

  const handleDurationChange = (value: string) => {
    if (value === "mixed") {
      return;
    }

    if (value === "all-day") {
      onChangeDuration(0);
      form.setValue("timeZone", "");
      onChange(
        datepicker.selection.map((date) => ({
          type: "date",
          date: formatDateWithoutTime(date),
        })),
      );
      return;
    }

    const minutes = Number(value);
    onChangeDuration(minutes);
    if (!form.getValues("timeZone")) {
      form.setValue("timeZone", defaultTimeZone);
    }
    // A date range means each day is part of the choice; preserve those days
    // when switching the poll to time slots instead of silently dropping them.
    const starts = new Set(
      options.flatMap((option) => {
        if (option.type === "timeSlot") {
          return [option.start];
        }
        const dates: string[] = [];
        const endDate = option.endDate ?? option.date;
        let currentDate = dayjs(option.date);
        while (currentDate.format("YYYY-MM-DD") <= endDate) {
          dates.push(middayOf(currentDate.format("YYYY-MM-DD")));
          currentDate = currentDate.add(1, "day");
        }
        return dates;
      }),
    );
    onChange(
      [...starts].map((start) => ({
        type: "timeSlot",
        start,
        end: addMinutesToWallTime(start, minutes),
      })),
    );
  };

  const optionsByDay = React.useMemo(() => {
    const res: Record<
      string,
      [
        {
          option: DateTimeOption;
          index: number;
        },
      ]
    > = {};

    options.forEach((option, index) => {
      const dateString =
        option.type === "date"
          ? option.date
          : option.start.substring(0, option.start.indexOf("T"));

      if (res[dateString]) {
        res[dateString].push({ option, index });
      } else {
        res[dateString] = [{ option, index }];
      }
    });

    return res;
  }, [options]);

  const datepickerSelection = React.useMemo(() => {
    return Object.keys(optionsByDay).map(
      (dateString) => new Date(`${dateString}T12:00:00`),
    );
  }, [optionsByDay]);

  const datepicker = useHeadlessDatePicker({
    selection: datepickerSelection,
    onNavigationChange: onNavigate,
    date,
  });

  React.useEffect(() => {
    if (isTimedEvent) {
      return;
    }

    const dateAtPoint = (event: PointerEvent) =>
      document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-calendar-date]")?.dataset.calendarDate;

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      const end = dateAtPoint(event);
      if (end && end !== drag.end) {
        drag.end = end;
        setRangePreview({ start: drag.start, end });
      }
    };

    const finishDrag = (event: PointerEvent, commit: boolean) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      dragRef.current = null;
      setRangePreview(null);

      const end = dateAtPoint(event) ?? drag.end;
      if (!commit || end === drag.start) {
        return;
      }

      const [startDate, endDate] = [drag.start, end].sort();
      const newOption: DateTimeOption = {
        type: "date",
        date: startDate,
        endDate,
      };
      const exists = options.some(
        (option) =>
          option.type === "date" &&
          option.date === startDate &&
          option.endDate === endDate,
      );
      if (!exists) {
        onChange([...options, newOption]);
      }
      onNavigate(new Date(`${endDate}T12:00:00`));

      ignoreClickRef.current = true;
      window.setTimeout(() => {
        ignoreClickRef.current = false;
      }, 0);
    };

    const onPointerUp = (event: PointerEvent) => finishDrag(event, true);
    const onPointerCancel = (event: PointerEvent) => finishDrag(event, false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [isTimedEvent, onChange, onNavigate, options]);

  return (
    <div className="overflow-hidden">
      <div className="border-b">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="font-medium text-sm">
            <Trans i18nKey="durationLabel" defaults="Duration" />
          </div>
          <RadioCards
            value={durationValue}
            onValueChange={handleDurationChange}
            className="flex-wrap gap-y-2"
          >
            {durationOptions.map((minutes) => (
              <RadioCardsItem key={minutes} value={String(minutes)}>
                <Duration minutes={minutes} />
              </RadioCardsItem>
            ))}
            <RadioCardsItem data-testid="all-day-option" value="all-day">
              <Trans i18nKey="allDay" defaults="All day" />
            </RadioCardsItem>
            {isMixed ? (
              <RadioCardsItem value="mixed" disabled>
                <Trans i18nKey="mixedDurations" defaults="Mixed" />
              </RadioCardsItem>
            ) : null}
          </RadioCards>
        </div>
      </div>
      <div className="md:flex">
        <div className="shrink-0 border-b p-3 sm:p-4 md:w-[380px] md:border-r md:border-b-0">
          <div>
            <div className="flex w-full flex-col">
              <div className="mb-3 flex items-center justify-center space-x-4">
                <Button
                  title={t("previousMonth", { defaultValue: "Previous month" })}
                  size="icon"
                  onClick={datepicker.prev}
                >
                  <ChevronLeftIcon />
                </Button>
                <div className="grow text-center font-semibold tracking-tight">
                  {datepicker.label}
                </div>
                <Button
                  title={t("nextMonth", { defaultValue: "Next month" })}
                  size="icon"
                  onClick={datepicker.next}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
              <div className="grid grid-cols-7">
                {datepicker.daysOfWeek.map((dayOfWeek) => {
                  return (
                    <div
                      key={dayOfWeek}
                      className="flex items-center justify-center pb-2 font-medium text-muted-foreground text-sm"
                    >
                      {dayOfWeek.substring(0, 2)}
                    </div>
                  );
                })}
              </div>
              <div className="grid grow grid-cols-7 overflow-hidden rounded-lg border shadow-xs">
                {datepicker.days.map((day, i) => {
                  const dayString = formatDateWithoutTime(day.date);
                  const isSelected = isTimedEvent
                    ? day.selected
                    : options.some(
                        (option) =>
                          option.type === "date" &&
                          dayString >= option.date &&
                          dayString <= (option.endDate ?? option.date),
                      );
                  const isInPreview =
                    !!rangePreview &&
                    dayString >=
                      (rangePreview.start < rangePreview.end
                        ? rangePreview.start
                        : rangePreview.end) &&
                    dayString <=
                      (rangePreview.start > rangePreview.end
                        ? rangePreview.start
                        : rangePreview.end);
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: Fix this later
                      key={i}
                      className={cn("h-11", {
                        "border-r": (i + 1) % 7 !== 0,
                        "border-b": i < datepicker.days.length - 7,
                      })}
                    >
                      <button
                        type="button"
                        data-calendar-date={dayString}
                        onPointerDown={(event) => {
                          if (!isTimedEvent && event.button === 0) {
                            dragRef.current = {
                              pointerId: event.pointerId,
                              start: dayString,
                              end: dayString,
                            };
                          }
                        }}
                        onClick={() => {
                          if (ignoreClickRef.current) {
                            ignoreClickRef.current = false;
                            return;
                          }
                          if (isSelected) {
                            onChange(removeAllOptionsForDay(options, day.date));
                          } else {
                            const selectedDate = dayjs(day.date)
                              .set("hour", 12)
                              .toDate();
                            const date = formatDateWithoutTime(selectedDate);
                            const newOption: DateTimeOption = !isTimedEvent
                              ? { type: "date", date }
                              : {
                                  type: "timeSlot",
                                  start: middayOf(date),
                                  end: addMinutesToWallTime(
                                    middayOf(date),
                                    slotDuration,
                                  ),
                                };

                            if (
                              options.length === 0 &&
                              newOption.type === "timeSlot" &&
                              !form.getValues("timeZone")
                            ) {
                              form.setValue("timeZone", defaultTimeZone);
                            }

                            onChange([...options, newOption]);
                            onNavigate(selectedDate);
                          }
                          if (day.outOfMonth) {
                            if (i < 6) {
                              datepicker.prev();
                            } else {
                              datepicker.next();
                            }
                          }
                        }}
                        className={cn(
                          "group relative flex h-full w-full items-start justify-end rounded-none px-2.5 py-1.5 font-medium text-sm tracking-tight focus:z-10 focus:rounded-sm",
                          {
                            "touch-none select-none": !isTimedEvent,
                            "bg-muted text-muted-foreground opacity-50":
                              day.isPast,
                            "text-rose-500": day.today && !isSelected,
                            "bg-muted/50 text-muted-foreground":
                              day.outOfMonth && !day.isPast,
                            "text-foreground": isSelected || isInPreview,
                          },
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-1 z-0 rounded-md border",
                            isSelected || isInPreview
                              ? "border-accent-border bg-accent shadow-xs group-hover:border-accent-border"
                              : "border-transparent group-hover:border-accent-border group-active:bg-accent",
                          )}
                        />
                        <span className="z-10">{day.day}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              {!isTimedEvent ? (
                <p className="mt-2 text-center text-muted-foreground text-xs">
                  <Trans
                    i18nKey="monthCalendarRangeHint"
                    defaults="Click and drag across dates to add a range."
                  />
                </p>
              ) : null}
              <Button className="mt-3" onClick={datepicker.today}>
                {t("today", { defaultValue: "Today" })}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex grow flex-col">
          <div className="min-h-0 grow overflow-auto">
            {options.length === 0 ? (
              <div className="flex h-full items-center justify-center py-12">
                <EmptyState>
                  <EmptyStateIcon>
                    <CalendarIcon />
                  </EmptyStateIcon>
                  <EmptyStateTitle>
                    <Trans
                      i18nKey="noDatesSelected"
                      defaults="No dates selected"
                    />
                  </EmptyStateTitle>
                  <EmptyStateDescription>
                    <Trans
                      i18nKey="noDatesSelectedDescription"
                      defaults="Click on a date to add a time slot"
                    />
                  </EmptyStateDescription>
                </EmptyState>
              </div>
            ) : isTimedEvent ? (
              <div className="divide-y">
                {Object.keys(optionsByDay)
                  .sort((a, b) => (a > b ? 1 : -1))
                  .map((dateString) => {
                    const optionsForDay = optionsByDay[dateString];
                    const dateParts = formatDateParts(
                      new Date(`${dateString}T12:00:00`),
                      { locale },
                    );
                    return (
                      <div
                        key={dateString}
                        className="space-y-3 p-3 sm:flex sm:items-start sm:space-x-4 sm:space-y-0 sm:p-4"
                      >
                        <DateCard day={dateParts.day} month={dateParts.month} />
                        <div className="grow space-y-3">
                          {optionsForDay.map(({ option, index }) => {
                            if (option.type === "date") {
                              throw new Error("Expected timeSlot but got date");
                            }
                            return (
                              <div
                                key={index}
                                className="flex items-center space-x-3"
                              >
                                <TimePicker
                                  value={option.start}
                                  timeZone={timeZone}
                                  onChange={(newStart) => {
                                    // replace enter with updated start time
                                    onChange([
                                      ...options.slice(0, index),
                                      {
                                        ...option,
                                        start: newStart,
                                        end: addMinutesToWallTime(
                                          newStart,
                                          slotDuration,
                                        ),
                                      },
                                      ...options.slice(index + 1),
                                    ]);
                                    onNavigate(navigationDateOf(newStart));
                                    onChangeDuration(slotDuration);
                                  }}
                                />
                                <TimePicker
                                  value={option.end}
                                  after={option.start}
                                  timeZone={timeZone}
                                  onChange={(newEnd) => {
                                    onChange([
                                      ...options.slice(0, index),
                                      {
                                        ...option,
                                        end: newEnd,
                                      },
                                      ...options.slice(index + 1),
                                    ]);
                                    onNavigate(navigationDateOf(newEnd));
                                    onChangeDuration(
                                      wallTimeDiffInMinutes(
                                        option.start,
                                        newEnd,
                                      ),
                                    );
                                  }}
                                />
                                <Button
                                  aria-label={t("removeTimeSlot", {
                                    defaultValue: "Remove time slot",
                                  })}
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    onChange([
                                      ...options.slice(0, index),
                                      ...options.slice(index + 1),
                                    ]);
                                  }}
                                >
                                  <XIcon />
                                </Button>
                              </div>
                            );
                          })}
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => {
                                const lastOption = expectTimeOption(
                                  optionsForDay[optionsForDay.length - 1]
                                    .option,
                                );

                                const startTime =
                                  lastOption.end.slice(0, 10) ===
                                  lastOption.start.slice(0, 10)
                                    ? // if the end time of the previous option is on the same day as the start time, use the end time
                                      lastOption.end
                                    : // otherwise use the start time
                                      lastOption.start;

                                onChange([
                                  ...options,
                                  {
                                    type: "timeSlot",
                                    start: startTime,
                                    end: addMinutesToWallTime(
                                      startTime,
                                      slotDuration,
                                    ),
                                  },
                                ]);
                              }}
                            >
                              <PlusIcon data-icon="inline-start" />
                              {t("addTimeOption", {
                                defaultValue: "Add time option",
                              })}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    aria-label={t("moreOptions", {
                                      defaultValue: "More options",
                                    })}
                                    variant="ghost"
                                    size="icon"
                                  />
                                }
                              >
                                <MoreVerticalIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={() => {
                                    const times = optionsForDay.map(
                                      ({ option }) => {
                                        if (option.type === "date") {
                                          throw new Error(
                                            "Expected timeSlot but got date",
                                          );
                                        }

                                        return {
                                          startTime: option.start.substring(
                                            option.start.indexOf("T"),
                                          ),
                                          endTime: option.end.substring(
                                            option.end.indexOf("T"),
                                          ),
                                        };
                                      },
                                    );
                                    const newOptions: DateTimeOption[] = [];
                                    Object.keys(optionsByDay).forEach(
                                      (dateString) => {
                                        times.forEach((time) => {
                                          const start =
                                            dateString + time.startTime;
                                          newOptions.push({
                                            type: "timeSlot",
                                            start: start,
                                            end: addMinutesToWallTime(
                                              start,
                                              slotDuration,
                                            ),
                                          });
                                        });
                                      },
                                    );
                                    onChange(newOptions);
                                  }}
                                >
                                  <SparklesIcon />
                                  <Trans
                                    i18nKey="applyToAllDates"
                                    defaults="Apply to all dates"
                                  />
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    onChange(
                                      removeAllOptionsForDay(
                                        options,
                                        new Date(dateString),
                                      ),
                                    );
                                  }}
                                >
                                  <CalendarXIcon />
                                  <Trans
                                    i18nKey="deleteDate"
                                    defaults="Delete date"
                                  />
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 p-3 sm:gap-4 sm:p-4">
                {options
                  .map((option, index) => ({ option, index }))
                  .filter(
                    (
                      item,
                    ): item is {
                      option: Extract<DateTimeOption, { type: "date" }>;
                      index: number;
                    } => item.option.type === "date",
                  )
                  .sort((a, b) => a.option.date.localeCompare(b.option.date))
                  .map(({ option, index }) => {
                    const dateParts = formatDateParts(
                      new Date(`${option.date}T12:00:00`),
                      { locale },
                    );
                    return (
                      <div
                        key={`${option.date}-${option.endDate ?? ""}-${index}`}
                        className="flex items-center gap-2"
                      >
                        <DateCard day={dateParts.day} month={dateParts.month} />
                        {option.endDate ? (
                          <>
                            <Input
                              aria-label={t("rangeStartDate", {
                                defaultValue: "Start date",
                              })}
                              type="date"
                              className="w-36"
                              value={option.date}
                              onChange={(event) => {
                                const nextDate = event.target.value;
                                const oldEndDate = option.endDate;
                                if (!nextDate || !oldEndDate) return;
                                const endDate =
                                  oldEndDate < nextDate
                                    ? undefined
                                    : oldEndDate;
                                onChange(
                                  options.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          type: "date",
                                          date: nextDate,
                                          ...(endDate && endDate !== nextDate
                                            ? { endDate }
                                            : {}),
                                        }
                                      : item,
                                  ),
                                );
                              }}
                            />
                            <span aria-hidden>–</span>
                            <Input
                              aria-label={t("rangeEndDate", {
                                defaultValue: "End date",
                              })}
                              type="date"
                              className="w-36"
                              value={option.endDate}
                              onChange={(event) => {
                                const nextEndDate = event.target.value;
                                if (!nextEndDate) return;
                                const nextDate =
                                  nextEndDate < option.date
                                    ? nextEndDate
                                    : option.date;
                                const endDate =
                                  nextEndDate <= option.date
                                    ? undefined
                                    : nextEndDate;
                                onChange(
                                  options.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          type: "date",
                                          date: nextDate,
                                          ...(endDate ? { endDate } : {}),
                                        }
                                      : item,
                                  ),
                                );
                              }}
                            />
                          </>
                        ) : null}
                        <Button
                          aria-label={t("removeDateOption", {
                            defaultValue: "Remove date option",
                          })}
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            onChange(
                              options.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          <XIcon />
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthCalendar;
