export interface OAuthUser {
  email: string;
  name: string;
  picture: string;
  provider: string;
  providerId: string;
}
export interface FacebookOAuthUser {
  email: string;
  name: string;
  picture: string;
  provider: string;
  facebookId: string;
}
