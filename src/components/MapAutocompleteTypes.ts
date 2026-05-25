export type Suggestion = { id: string; place_name: string; center?: [number, number] };

export type SuggestionGroup = {
  label: string;
  items: Suggestion[];
};
