export interface User
{
    bio: string;
    brand: string;
    clout: number;
    code: string;
    dateAdded: Date;
    dateUpdated: Date;
    email: string;
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