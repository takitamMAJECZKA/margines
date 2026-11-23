import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import type { WordSet } from "@/db/types";
import { RECENT_SET_ID, RECENT_SET_NAME } from "@/lib/study-scope";

export function StudyScopeSelector({
  sets,
  value,
  onChange,
}: {
  sets: WordSet[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="study-scope">Zakres nauki</Label>
      <NativeSelect
        id="study-scope"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Wszystkie słowa</option>
        <option value={RECENT_SET_ID}>{RECENT_SET_NAME}</option>
        {sets.map((set) => (
          <option key={set.id} value={set.id}>
            {set.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
