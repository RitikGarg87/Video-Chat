import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'test-room'
        await self.channel_layer.group_add(
            self.room_group_name, self.channel_name
        )
        # print("connected")
        await self.accept()
        

    async def disconnect(self, code):
        await self.channel_layer.group_discard(
            self.room_group_name, self.channel_name
        )
        # print("dissconnected")

    async def receive(self, text_data):
        receive_dict = json.loads(text_data)
        # print(receive_dict)
        message = receive_dict['message']
        action = receive_dict['action']
        if (action == 'new-offer') or (action == 'new-answer'):
            receive_channel_name = receive_dict['message']['receiver_channel_name']
            receive_dict['message']['receiver_channel_name'] = self.channel_name

            await self.channel_layer.send(
                receive_channel_name, 
                {
                    'type':'send.sdp',
                    'receive_dict':receive_dict
                }
            )
            return
        receive_dict['message']['receiver_channel_name'] = self.channel_name
        await self.channel_layer.group_send(
            self.room_group_name, 
            {
                'type':'send.sdp',
                'receive_dict':receive_dict
            }
        )
    
    async def send_sdp(self, event):
        # print(event, "hiii bro")
        receive_dict = event['receive_dict']

        await self.send(text_data=json.dumps(receive_dict))