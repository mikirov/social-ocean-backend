export interface Brand
{
    dateAdded: Date;
    details: string;
    domain: string;
    externalId: string;
    isActive: boolean;
    isApproved: boolean;
    isBlacklisted: boolean;
    isListed: boolean;
    isPreferred: boolean;
    isRequested: boolean;
    isSubmitted: boolean;
    isTryScrape: boolean;
    lastRequested: Date;
    lastSubmitted: Date;
    lastTryScrape: Date;
    link: string;
    subtitle: string;
    title: string;
}