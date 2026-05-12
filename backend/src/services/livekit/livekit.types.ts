export interface GenerateAccessTokenOptions {
  identity: string;
  name: string;
  roomName: string;
  ttlSeconds?: number;
}

export interface AccessTokenResult {
  token: string;
  url: string;
  roomName: string;
}
