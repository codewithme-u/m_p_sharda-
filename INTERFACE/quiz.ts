export interface Quiz {
    id: number;
    title: string;
    description?: string;
    code: string;
    active: boolean;
    questionsCount: number;
    createdDate: string;

    // Optional fields (may be provided by backend)
    timeLimit?: number;        // minutes
    scheduledDate?: string;    // ISO string or date string
}
