export interface Product
{
    boughtCount: number;
    postCount: number;
    recommendationCount: number;
    totalPostLikes: number;
    totalRecommendationLikes: number;

    favoriteCount: number;
    saveCount: number;

    brand: string;
    category: string;
    dateAdded: Date;
    details: string;
    domain: string;
    externalId: string;
    hero: string;
    isActive: boolean;
    isCatchofTheDay: boolean;
    isHighlighted: boolean;
    isPopularUS: boolean;
    link: string;
    localPath: string;
    remotePath: string;
    shipping: string;
    subtitle: string;
    title: string;
}
