export type Recipient = {
    id: number;
    name: string;
    phoneNumber: string;
};

export type RecipientTemplate = {
    name: string;
    phoneNumber: string;
};

export type CreateRecipientError =
    | 'NoNameProvided'
    | 'NoPhoneNumberProvided'
    | 'RecipientNameTaken'
    | 'PhoneNumberTaken';

export type ScheduledMessage = {
    id: number;
    recipient: Recipient;
    message: string;
    scheduledDate: number;
    failedToSend: boolean;
};

export type ScheduledTemplate = {
    message: string;
    scheduledDate: number;
} & ({ recipientId: number } | RecipientTemplate);

export type CreatedScheduledMessageError =
    | CreateRecipientError
    | 'NoMessageProvided'
    | 'NoRecipientIdProvided'
    | 'NoScheduledDateProvided'
    | 'ScheduledDateInPast';
