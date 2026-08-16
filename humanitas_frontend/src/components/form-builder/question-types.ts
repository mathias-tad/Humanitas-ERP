/**
 * Krinai  Question Type Definitions
 * All 18 supported question types with metadata, icons, and default configs.
 */

export interface QuestionOption {
    id: string;
    label: string;
    score?: number;
}

export interface QuestionRubric {
    max_score: number;
    scoring_type: "manual" | "auto_mcq";
}

export interface QuestionValidation {
    min_length?: number;
    max_length?: number;
    regex?: string;
    min_value?: number;
    max_value?: number;
}

export interface QuestionConfig {
    min?: number;
    max?: number;
    step?: number;
    allowed_types?: string[];
    max_file_size_mb?: number;
    max_files?: number;
    scale_labels?: { low?: string; high?: string };
}

export interface FormQuestion {
    id: string;
    section_id?: string;
    order: number;
    type: QuestionType;
    label: string;
    helper_text: string;
    required: boolean;
    validation?: QuestionValidation;
    options: QuestionOption[];
    rubric?: QuestionRubric;
    config?: QuestionConfig;
}

export interface FormSection {
    id: string;
    title: string;
    description: string;
    order: number;
}

export interface LogicCondition {
    question_id: string;
    operator: string;
    value: string;
}

export interface LogicRule {
    id: string;
    type: "show" | "hide" | "required" | "jump" | "disqualify";
    condition: LogicCondition;
    target_question_id?: string;
    target_section_id?: string;
}

export interface FormDefinition {
    id: string;
    job_id: string;
    version: number;
    sections: FormSection[];
    questions: FormQuestion[];
    logic_rules: LogicRule[];
}

export type QuestionType =
    | "short_text" | "paragraph" | "mcq_single" | "mcq_multi"
    | "dropdown" | "linear_scale" | "ranking" | "date"
    | "yes_no" | "number" | "url" | "email" | "phone"
    | "file_upload" | "image_upload" | "video_url"
    | "section_header" | "descriptive_text";

export interface QuestionTypeMeta {
    type: QuestionType;
    label: string;
    icon: string;
    category: "text" | "choice" | "input" | "media" | "layout";
    hasOptions: boolean;
    isInput: boolean;
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
    // Text
    { type: "short_text", label: "Short Text", icon: "Type", category: "text", hasOptions: false, isInput: true },
    { type: "paragraph", label: "Paragraph", icon: "AlignLeft", category: "text", hasOptions: false, isInput: true },
    // Choice
    { type: "mcq_single", label: "Multiple Choice", icon: "CircleDot", category: "choice", hasOptions: true, isInput: true },
    { type: "mcq_multi", label: "Checkboxes", icon: "CheckSquare", category: "choice", hasOptions: true, isInput: true },
    { type: "dropdown", label: "Dropdown", icon: "ChevronDown", category: "choice", hasOptions: true, isInput: true },
    { type: "linear_scale", label: "Linear Scale", icon: "Sliders", category: "choice", hasOptions: false, isInput: true },
    { type: "ranking", label: "Ranking", icon: "ArrowUpDown", category: "choice", hasOptions: true, isInput: true },
    { type: "yes_no", label: "Yes / No", icon: "ToggleLeft", category: "choice", hasOptions: false, isInput: true },
    // Input
    { type: "date", label: "Date", icon: "Calendar", category: "input", hasOptions: false, isInput: true },
    { type: "number", label: "Number", icon: "Hash", category: "input", hasOptions: false, isInput: true },
    { type: "email", label: "Email", icon: "Mail", category: "input", hasOptions: false, isInput: true },
    { type: "phone", label: "Phone", icon: "Phone", category: "input", hasOptions: false, isInput: true },
    { type: "url", label: "URL", icon: "Link", category: "input", hasOptions: false, isInput: true },
    // Media
    { type: "file_upload", label: "File Upload", icon: "Paperclip", category: "media", hasOptions: false, isInput: true },
    { type: "image_upload", label: "Image Upload", icon: "Image", category: "media", hasOptions: false, isInput: true },
    { type: "video_url", label: "Video URL", icon: "Video", category: "media", hasOptions: false, isInput: true },
    // Layout
    { type: "section_header", label: "Section Header", icon: "Heading", category: "layout", hasOptions: false, isInput: false },
    { type: "descriptive_text", label: "Description", icon: "FileText", category: "layout", hasOptions: false, isInput: false },
];

let _counter = 0;
export function generateId(): string {
    return `q_${Date.now()}_${++_counter}`;
}

export function createDefaultQuestion(type: QuestionType): FormQuestion {
    const meta = QUESTION_TYPES.find(t => t.type === type)!;
    const q: FormQuestion = {
        id: generateId(),
        order: 0,
        type,
        label: meta.label,
        helper_text: "",
        required: false,
        options: [],
    };

    if (meta.hasOptions) {
        q.options = [
            { id: generateId(), label: "Option 1" },
            { id: generateId(), label: "Option 2" },
            { id: generateId(), label: "Option 3" },
        ];
    }

    if (type === "yes_no") {
        q.options = [
            { id: "yes", label: "Yes" },
            { id: "no", label: "No" },
        ];
    }

    if (type === "linear_scale") {
        q.config = { min: 1, max: 5, step: 1 };
    }

    if (type === "file_upload") {
        q.config = { allowed_types: ["pdf", "doc", "docx"], max_file_size_mb: 10 };
    }

    if (type === "image_upload") {
        q.config = { allowed_types: ["jpg", "jpeg", "png", "webp"], max_file_size_mb: 5 };
    }

    return q;
}
