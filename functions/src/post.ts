export interface Post
{
    author: string;
    authorImage: string;
    authorIsApproved: boolean;
    authorIsBrand: boolean;
    authorIsPreferred: boolean;
    authorRemoteImage: string;
    authorScore: number;

    dateAdded: Date;

    details: string;
    isActive: boolean;
    localPath: string;
    remotePath: string;
    rate: number;
    title: string;
    subtitle: string;

    externalProductId: string;
    userId: string;


    productBrand: string;
    productDomain: string;
    productFavoriteCount: number;
    productLocalPath: string;
    productRemotePath: string;
    productSaveCount: number;
    productTitle: string;
}