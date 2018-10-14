# Slack addon for OpenTMI


## Configurations

```
{
  "opentmi-slack": {
    "token": "<token>",
    "defaultChannel": "<bot-channel>",
    "filters": {
      "allowedChannels": ["<channelName>"],
      "allowedUsers": ["<real_name>"]
    },
    "result": {
      "filters": {
        <name>: <filter-object>
      },
      "templates": {
        <name>: "<template>"
      }
    }
  }
}
```
