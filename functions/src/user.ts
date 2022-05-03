export interface User
{
    bio: string;
    brand: string;

    code: string;
    dateAdded: Date;
    dateUpdated: Date;
    email: string;

    clout: number;
    followerCount: number;
    followingCount: number;

    isActive: boolean;
    isAdmin: boolean;
    isApproved: boolean;
    isBrand: boolean;
    isChanged: boolean;
    isPreferred: boolean;
    link: string;
    localPath: string;
    name: string;
    phone: string;
    remotePath: string;

    fcmToken: string;
}