export interface Recommendation
{
    author: string;
    authorImage: string;
    authorIsApproved: boolean;
    authorIsBrand: boolean;
    authorIsPreferred: boolean;
    authorRemoteImage: string;
    authorScore: number;

    dateAdded: Date;
    dateUpdated: Date;

    details: string;
    isActive: boolean;
    localPath: string;
    remotePath: string;
    rate: number;
    title: string;
    brand: string;

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