import { parse24h, split24h } from "@/utils/time";

interface TimeInputProps {
  value: string; // HH:MM 24h
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59

export function TimeInput({
  value,
  onChange,
  className = "",
  disabled,
  id,
  name,
}: TimeInputProps) {
  const { hour12, minute, period } = split24h(value);

  function emit(nextHour: number, nextMinute: number, nextPeriod: "AM" | "PM") {
    onChange(parse24h(nextHour, nextMinute, nextPeriod));
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select
        id={id}
        name={name ? `${name}-hour` : undefined}
        disabled={disabled}
        value={hour12}
        onChange={(e) => emit(Number(e.target.value), minute, period)}
        className="input-field flex-1 px-2"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="font-semibold text-slate-500">:</span>
      <select
        name={name ? `${name}-minute` : undefined}
        disabled={disabled}
        value={minute}
        onChange={(e) => emit(hour12, Number(e.target.value), period)}
        className="input-field flex-1 px-2"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        name={name ? `${name}-period` : undefined}
        disabled={disabled}
        value={period}
        onChange={(e) =>
          emit(hour12, minute, e.target.value as "AM" | "PM")
        }
        className="input-field flex-1 px-2"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
