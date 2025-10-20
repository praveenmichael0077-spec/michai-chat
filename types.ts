export enum Sender {
  User = 'user',
  Michai = 'michai',
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  imageUrl?: string;
}
