import { layoutProblem, type LabelLayout } from './label-templates.layout';

const a4 = (over: Partial<LabelLayout> = {}): LabelLayout => ({
  layout: 'sheet', label_width_mm: 70, label_height_mm: 37, page_width_mm: 210, page_height_mm: 297,
  columns: 3, rows: 8, margin_top_mm: 0.5, margin_left_mm: 0, gap_x_mm: 0, gap_y_mm: 0, ...over,
});

describe('label layout', () => {
  it('accepts the usual A4 sticker sheets and roll labels', () => {
    expect(layoutProblem(a4())).toBeNull();
    expect(layoutProblem(a4({ label_width_mm: 48.5, label_height_mm: 25.4, columns: 4, rows: 10, margin_left_mm: 8, margin_top_mm: 21.5 }))).toBeNull();
    expect(layoutProblem(a4({ layout: 'roll', label_width_mm: 50, label_height_mm: 25, columns: 99 }))).toBeNull();
  });

  it('says how much room the labels need when they do not fit', () => {
    expect(layoutProblem(a4({ columns: 4 }))).toBe('4 labels of 70 mm with 0 mm gaps and a 0 mm margin need 280 mm; the page is 210 mm wide');
    expect(layoutProblem(a4({ rows: 9 }))).toMatch(/need 333.5 mm; the page is 297 mm high/);
  });

  it('refuses sizes outside what printers handle', () => {
    expect(layoutProblem(a4({ label_width_mm: 5 }))).toMatch(/10 to 300 mm/);
    expect(layoutProblem(a4({ page_width_mm: 1000 }))).toMatch(/20 to 600 mm/);
    expect(layoutProblem(a4({ columns: 0 }))).toMatch(/columns/);
    expect(layoutProblem(a4({ gap_x_mm: -1 }))).toMatch(/Margins and gaps/);
  });

  it('reads numbers stored as text (NUMERIC columns)', () => {
    expect(layoutProblem(a4({ label_width_mm: '70.00', columns: '3', margin_top_mm: '0.50' }))).toBeNull();
  });
});
