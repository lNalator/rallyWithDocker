import type * as React from "react";

import type { PollOptionProps } from "./poll-option";
import PollOption from "./poll-option";

export interface DateOptionProps extends PollOptionProps {
  dow: string;
  day: string;
  month: string;
  endDow?: string;
  endDay?: string;
  endMonth?: string;
}

const DateOption: React.FunctionComponent<DateOptionProps> = ({
  dow,
  day,
  endDow,
  endDay,
  endMonth,
  ...rest
}) => {
  return (
    <PollOption {...rest}>
      {/**
       * Intentionally using the month prop for the day of week here as a temporary measure
       * until we update this component.
       */}
      <div className="text-sm">
        {day} {dow}
        {endDay && endDow ? (
          <>
            {" – "}
            {endDay} {endDow}
          </>
        ) : null}
      </div>
    </PollOption>
  );
};

export default DateOption;
