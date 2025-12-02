export interface NotificationStruct {
    content: string,
    date: Date,
    "info-type": "Monitor" | "Configuration" | "Network" | "Others",
    name: string,
    isRead: boolean,
    type: 0 | 1 | 2
}

export const notificationTypeMap: string[] = ["normal", "warning", "danger"];
